// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.jsx'

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )



import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'


import { BrowserRouter } from 'react-router-dom';

import OrganizerContextProvider from './Contexts/OrganizerContext/OrganizerContext';
import AdminContextProvider from './Contexts/AdminContext/AdminContext';
import PlayerContextProvider from './Contexts/PlayerContext/PlayerContext';
import AppContextProvider from './Contexts/AppContext/AppContext';

import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')).render(
  <BrowserRouter> 
  <AppContextProvider>
   <AdminContextProvider>
    <OrganizerContextProvider>
     <PlayerContextProvider>
       <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
     </PlayerContextProvider>
    </OrganizerContextProvider>
   </AdminContextProvider>
  </AppContextProvider>
  </BrowserRouter>
)
