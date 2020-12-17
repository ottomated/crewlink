import React, { useContext, useEffect, useReducer, useState } from 'react';
import { SettingsDispatchValues, SettingsContext } from './contexts';
import './css/settings.css';
import MicrophoneSoundBar from './MicrophoneSoundBar';
import TestSpeakersButton from './TestSpeakersButton';
import { store, validateURL } from './settingsStore';
import { ISettings } from '../common/ISettings';
import { CircleSpinner } from 'react-spinners-kit';

const keys = new Set(['Space', 'Backspace', 'Delete', 'Enter', 'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'LControl', 'LShift', 'LAlt', 'RControl', 'RShift', 'RAlt']);

interface SettingsPageProps {
	open: boolean;
	onClose: () => void;
}

interface MediaDevice {
	id: string;
	kind: MediaDeviceKind;
	label: string;
}

interface URLInputProps {
	initialURL: string;
	onValidURL: (url: string) => void;
}

/** Allows the user to input a URL */
function URLInput({ initialURL, onValidURL }: URLInputProps) {
	const [isValidURL, setURLValid] = useState(true);
	const [currentURL, setCurrentURL] = useState(initialURL);
	const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout>();
	const [showSpinner, setShowSpinner] = useState(false);

	function onChange(event: React.ChangeEvent<HTMLInputElement>) {
		setCurrentURL(event.target.value);

		setShowSpinner(true);
		// NOTE: Disabling because typing is being overzealous
		//       and clearTimout is acutally very permissive
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		clearTimeout(debounceTimer!);
		setDebounceTimer(setTimeout(() => {
			setShowSpinner(false);
			if (validateURL(event.target.value)) {
				setURLValid(true);
				onValidURL(event.target.value);
			} else {
				setURLValid(false);
			}
		}, 2.5 * 1000));
	}

	return <>
		<input
			className={isValidURL ? '' : 'input-error'}
			spellCheck={false}
			type="text"
			value={currentURL}
			onChange={onChange} />
		<div style={{ display: 'inline-block' }}>
			{showSpinner || <CircleSpinner size={10} />}
		</div>
	</>;
}

const SettingsPage: React.FC<SettingsPageProps> = function (props: SettingsPageProps) {
	const [settings, setSettings] = useContext(SettingsContext);
	const [unsavedCount, setUnsavedCount] = useState(0);
	const isUnsaved = unsavedCount > 2;

	useEffect(() => {
		setUnsavedCount(s => s + 1);
	}, [settings.microphone, settings.speaker, settings.serverURL, settings.enableSpatialAudio]);

	useEffect(() => {
		setSettings({
			type: 'set',
			action: store.store
		});
	}, []);

	// HACK: Workaround default values being loaded into child components
	//       and react state keeping default values instead of user values.
	//       This shouldn't be user visable as settings is hidden by default.
	const [delay, endDelay] = useState(true);
	setTimeout(() => endDelay(false), 2 * 1000);

	return <div id="settings" style={{ transform: props.open ? 'translateX(0)' : 'translateX(-100%)' }}>
		<svg className="titlebar-button back" viewBox="0 0 24 24" fill="#868686" width="20px" height="20px" onClick={() => {
			if (isUnsaved) {
				props.onClose();
				location.reload();
			} else{
				props.onClose();
			}
		}}>
			<path d="M0 0h24v24H0z" fill="none" />
			<path d="M11.67 3.87L9.9 2.1 0 12l9.9 9.9 1.77-1.77L3.54 12z" />
		</svg>
		{delay 
			? 'Loading Settings' 
			:  <Settings
				{...props}
				settings={settings}
				setSettings={setSettings}
			/>
		}
	</div>;
};

interface SettingsProps extends SettingsPageProps {
	settings: ISettings,
	setSettings: React.Dispatch<SettingsDispatchValues>
}

const Settings: React.FC<SettingsProps> = function (
	{ settings, setSettings, open }: SettingsProps
) {
	const [unsavedCount, setUnsavedCount] = useState(0);
	const unsaved = unsavedCount > 2;

	useEffect(() => {
		setUnsavedCount(s => s + 1);
	}, [settings.microphone, settings.speaker, settings.serverURL, settings.enableSpatialAudio]);

	const [devices, setDevices] = useState<MediaDevice[]>([]);
	const [_, updateDevices] = useReducer((state) => state + 1, 0);
	useEffect(() => {
		navigator.mediaDevices.enumerateDevices()
			.then(devices => setDevices(devices
				.map(d => {
					let label = d.label;
					if (d.deviceId === 'default') {
						label = 'Default';
					} else {
						const match = /(.+?)\)/.exec(d.label);
						if (match && match[1])
							label = match[1] + ')';
					}
					return {
						id: d.deviceId,
						kind: d.kind,
						label
					};
				})
			));
	}, [_]);

	/**
	 * Sets shortcut settings
	 * @param ev Keyboayrd event
	 * @param shortcut The setting key to be configured
	 */
	const setShortcut = (
		ev: React.KeyboardEvent<HTMLInputElement>,
		shortcut: 'pushToTalkShortcut' | 'deafenShortcut'
	) => {
		let k = ev.key;
		if (k.length === 1) k = k.toUpperCase();
		else if (k.startsWith('Arrow')) k = k.substring(5);
		if (k === ' ') k = 'Space';

		if (k === 'Control' || k === 'Alt' || k === 'Shift')
			k = (ev.location === 1 ? 'L' : 'R') + k;

		if (/^[0-9A-Z]$/.test(k) || /^F[0-9]{1,2}$/.test(k) ||
			keys.has(k)
		) {
			setSettings({
				type: 'setOne',
				action: [shortcut, k]
			});
		}
	};

	const microphones = devices.filter(d => d.kind === 'audioinput');
	const speakers = devices.filter(d => d.kind === 'audiooutput');

	return <div className="settings-scroll">
		<div className="form-control m l" style={{ color: '#e74c3c' }}>
			<label>Microphone</label>
			<select value={settings.microphone} onChange={(ev) => {
				setSettings({
					type: 'setOne',
					action: ['microphone', microphones[ev.target.selectedIndex].id]
				});
			}} onClick={() => updateDevices()}>
				{
					microphones.map(d => (
						<option key={d.id} value={d.id}>{d.label}</option>
					))
				}
			</select>
			{open && <MicrophoneSoundBar microphone={settings.microphone} />}
		</div>
		<div className="form-control m l" style={{ color: '#e67e22' }}>
			<label>Speaker</label>
			<select value={settings.speaker} onChange={(ev) => {
				setSettings({
					type: 'setOne',
					action: ['speaker', speakers[ev.target.selectedIndex].id]
				});
			}} onClick={() => updateDevices()}>
				{
					speakers.map(d => (
						<option key={d.id} value={d.id}>{d.label}</option>
					))
				}
			</select>
			{open && <TestSpeakersButton speaker={settings.speaker} />}
		</div>

		<div className="form-control" style={{ color: '#f1c40f' }} onClick={() => setSettings({
			type: 'setOne',
			action: ['pushToTalk', false]
		})}>
			<input type="checkbox" checked={!settings.pushToTalk} style={{ color: '#f1c40f' }} readOnly />
			<label>Voice Activity</label>
		</div>
		<div className={`form-control${settings.pushToTalk ? '' : ' m'}`} style={{ color: '#f1c40f' }} onClick={() => setSettings({
			type: 'setOne',
			action: ['pushToTalk', true]
		})}>
			<input type="checkbox" checked={settings.pushToTalk} readOnly />
			<label>Push to Talk</label>
		</div>
		{settings.pushToTalk &&
			<div className="form-control m" style={{ color: '#f1c40f' }}>
				<input spellCheck={false} type="text" value={settings.pushToTalkShortcut} readOnly onKeyDown={(ev) => setShortcut(ev, 'pushToTalkShortcut')} />
			</div>
		}
		<div className="form-control l m" style={{ color: '#2ecc71' }}>
			<label>Deafen Shortcut</label>
			<input spellCheck={false} type="text" value={settings.deafenShortcut} readOnly onKeyDown={(ev) => setShortcut(ev, 'deafenShortcut')} />
		</div>
		<div className="form-control l m" style={{ color: '#3498db' }}>
			<label>Voice Server</label>
			<URLInput initialURL={settings.serverURL} onValidURL={(url: string) => {
				setSettings({
					type: 'setOne',
					action: ['serverURL', url]
				});
			}} />
		</div>
		<div className="form-control m" style={{ color: '#9b59b6' }} onClick={() => setSettings({
			type: 'setOne',
			action: ['hideCode', !settings.hideCode]
		})}>
			<input type="checkbox" checked={!settings.hideCode} style={{ color: '#9b59b6' }} readOnly />
			<label>Show Lobby Code</label>
		</div>
		<div className="form-control m" style={{ color: '#fd79a8' }} onClick={() => setSettings({
			type: 'setOne',
			action: ['enableSpatialAudio', !settings.enableSpatialAudio]
		})}>
			<input type="checkbox" checked={settings.enableSpatialAudio} style={{ color: '#fd79a8' }} readOnly />
			<label>Enable Spatial Audio</label>
		</div>
		<div className='settings-alert' style={{ display: unsaved ? 'flex' : 'none' }}>
			<span>
				Exit to apply changes
			</span>
		</div>
	</div>;
};

export default SettingsPage;
