import { useEffect } from "react";

interface NavigationState {
  activeChatId: string | null;
  showProfileSettings: boolean;
  showCreateGroupModal: boolean;
}

export function useNativeBackNavigation({
  activeChatId,
  setActiveChatId,
  showProfileSettings,
  setShowProfileSettings,
  showCreateGroupModal,
  setShowCreateGroupModal
}: {
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  showProfileSettings: boolean;
  setShowProfileSettings: (show: boolean) => void;
  showCreateGroupModal: boolean;
  setShowCreateGroupModal: (show: boolean) => void;
}) {
  
  // 1. Monitor state changes and push virtual bookmarks to history
  useEffect(() => {
    const currentState = window.history.state as NavigationState | null;
    
    // Build desired coordinates for tracking 
    const targetState: NavigationState = {
      activeChatId,
      showProfileSettings,
      showCreateGroupModal,
    };

    // Prevent push-redundancy if states match
    const isStateIdentical = 
      currentState &&
      currentState.activeChatId === activeChatId &&
      currentState.showProfileSettings === showProfileSettings &&
      currentState.showCreateGroupModal === showCreateGroupModal;

    if (!isStateIdentical) {
      // Determine if visual elements are active
      const isAnyPanelOpen = activeChatId !== null || showProfileSettings || showCreateGroupModal;
      
      if (isAnyPanelOpen) {
        // Enforce virtual history layer to absorb the next back event
        window.history.pushState(targetState, "", "");
      }
    }
  }, [activeChatId, showProfileSettings, showCreateGroupModal]);

  // 2. Intercept popped states (physical back click, swipe gestures, back buttons)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as NavigationState | null;

      if (!state) {
        // No virtual state available -> close any open interfaces safely
        if (activeChatId) setActiveChatId(null);
        if (showProfileSettings) setShowProfileSettings(false);
        if (showCreateGroupModal) setShowCreateGroupModal(false);
      } else {
        // Restore coordinates based on backward history navigation
        setActiveChatId(state.activeChatId);
        setShowProfileSettings(state.showProfileSettings);
        setShowCreateGroupModal(state.showCreateGroupModal);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activeChatId, showProfileSettings, showCreateGroupModal, setActiveChatId, setShowProfileSettings, setShowCreateGroupModal]);
}
