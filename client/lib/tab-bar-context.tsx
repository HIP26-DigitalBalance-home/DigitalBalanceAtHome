import React, { createContext, useContext, useState } from 'react';

type TabBarContextValue = {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

const TabBarContext = createContext<TabBarContextValue>({
  hidden: false,
  setHidden: () => {},
});

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  return (
    <TabBarContext.Provider value={{ hidden, setHidden }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  return useContext(TabBarContext);
}
