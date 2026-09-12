import React, { createContext, useContext, useState } from 'react';

const HelpContext = createContext();

export const HelpProvider = ({ children }) => {
    const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);
    const [activeHelpMenu, setActiveHelpMenu] = useState("Business Overview");

    const toggleHelp = () => setHelpDrawerOpen(prev => !prev);
    const closeHelp = () => setHelpDrawerOpen(false);
    const openHelp = () => setHelpDrawerOpen(true);

    const openHelpWithMenu = (menu) => {
        setActiveHelpMenu(menu);
        setHelpDrawerOpen(true);
    };

    return (
        <HelpContext.Provider value={{ helpDrawerOpen, activeHelpMenu, toggleHelp, closeHelp, openHelp, openHelpWithMenu }}>
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
