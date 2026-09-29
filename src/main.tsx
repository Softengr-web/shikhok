import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './layout-overrides.css';
import './gig-builder.css';
import './gig-capabilities.css';
import './teacher-profile-gigs.css';
import './teacher-comparison.css';
import './gig-marketplace.css';
import './gig-detail.css';
import './problem-marketplace.css';
import './classroom.css';
import './exams-marketplace.css';
import './messages.css';
import { RootApp } from './RootApp';

createRoot(document.getElementById('root')!).render(<StrictMode><RootApp /></StrictMode>);
