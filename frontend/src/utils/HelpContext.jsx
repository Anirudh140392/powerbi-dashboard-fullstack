import React, { createContext, useContext, useState } from 'react';

const HelpContext = createContext();

export const HelpProvider = ({ children }) => {
    const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);

    const toggleHelp = () => setHelpDrawerOpen(prev => !prev);
    const closeHelp = () => setHelpDrawerOpen(false);
    const openHelp = () => setHelpDrawerOpen(true);

    return (
        <HelpContext.Provider value={{ helpDrawerOpen, toggleHelp, closeHelp, openHelp }}>
            {children}
        </HelpContext.Provider>
    );
};

export const useHelp = () => {
    const context = useContext(HelpContext);
    if (!context) {
        throw new Error('useHelp must be used within a HelpProvider');
    }
    return context;
};
