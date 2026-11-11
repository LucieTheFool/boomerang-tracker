import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Overlay } from './Overlay';
import './styles.css';

const isOverlay = new URLSearchParams(location.search).has('overlay');
createRoot(document.getElementById('root')!).render(isOverlay ? <Overlay /> : <App />);
