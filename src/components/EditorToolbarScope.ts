import { createContext } from 'react';

// Radix mounts select content outside the toolbar's DOM. React context crosses both portals.
export const EditorToolbarScope = createContext(false);
