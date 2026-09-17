import { createContext, useContext, useState, ReactNode } from "react";

type AuthModalTab = "login" | "signup";

interface AuthModalContextValue {
  isOpen: boolean;
  activeTab: AuthModalTab;
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;
  setActiveTab: (tab: AuthModalTab) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | undefined>(undefined);

export const AuthModalProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState<AuthModalTab>("login");

  const openAuthModal = (tab: AuthModalTab = "login") => {
    setActiveTabState(tab);
    setIsOpen(true);
  };

  const closeAuthModal = () => setIsOpen(false);

  const setActiveTab = (tab: AuthModalTab) => setActiveTabState(tab);

  return (
    <AuthModalContext.Provider value={{ isOpen, activeTab, openAuthModal, closeAuthModal, setActiveTab }}>
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = () => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return ctx;
};