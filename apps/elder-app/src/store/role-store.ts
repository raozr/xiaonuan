import { create } from 'zustand';
import { COMPANIONEE_ROLE, STEWARD_ROLE } from '../utils/constants';

type Role = typeof COMPANIONEE_ROLE | typeof STEWARD_ROLE;

interface RoleState {
  role: Role;
  setRole: (role: Role) => void;
}

export const useRoleStore = create<RoleState>((set) => ({
  role: COMPANIONEE_ROLE,
  setRole: (role) => set({ role }),
}));
