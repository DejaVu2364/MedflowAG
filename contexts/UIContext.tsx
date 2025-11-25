import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Page } from '../types';

interface UIContextType {
    page: Page;
    setPage: (page: Page) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    isChatOpen: boolean;
    toggleChat: () => void;
    error: string | null;
    setError: (error: string | null) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}

const UIContext = createContext<UIContextType | null>(null);

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error("useUI must be used within a UIProvider");
    return context;
};

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [page, _setPage] = useState<Page>('dashboard');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const setPage = useCallback((newPage: Page) => {
        setError(null);
        _setPage(newPage);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    }, []);

    const toggleChat = useCallback(() => {
        setIsChatOpen(prev => !prev);
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    return (
        <UIContext.Provider value={{ page, setPage, theme, toggleTheme, isChatOpen, toggleChat, error, setError, isLoading, setIsLoading }}>
            {children}
        </UIContext.Provider>
    );
};
