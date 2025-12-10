import { create } from "zustand";

export type UserTicket = {
  id: string;
  user_id: string;
  event_id: string;
  price: string;
  is_used: boolean;
  created_at: string;
};

type TicketsState = {
  tickets: UserTicket[];
  loading: boolean;
  error: string | null;
  setTickets: (tickets: UserTicket[]) => void;
  addTicket: (ticket: UserTicket) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useTicketsStore = create<TicketsState>((set) => ({
  tickets: [],
  loading: false,
  error: null,
  setTickets: (tickets) => set({ tickets }),
  addTicket: (ticket) =>
    set((state) => ({ tickets: [...state.tickets, ticket] })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set({ tickets: [], loading: false, error: null }),
}));
