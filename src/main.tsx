import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './layout-overrides.css';
import './gig-builder.css';
import './gig-capabilities.css';
import './teacher-profile-gigs.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
