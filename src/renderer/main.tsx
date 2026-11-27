import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import { App, SettingsWindow } from './App';
import { Overlay } from './Overlay';
import './styles.css';

const params = new URLSearchParams(location.search);
const isOverlay = params.has('overlay');
const isSettings = params.has('settings');
createRoot(document.getElementById('root')!).render(isOverlay ? <Overlay /> : isSettings ? <SettingsWindow /> : <App />);
