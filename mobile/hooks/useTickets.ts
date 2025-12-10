import { useCallback } from "react";
import { createApiClient } from "@/utils/apiWrapper";
import { useTicketsStore, UserTicket } from "@/store/useTicketStore";

const EVENTS_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL_EVENTS ?? "";

type TicketsResponse = {
  status: string;
  message: string;
  user_tickets: UserTicket[];
};

type PurchaseTicketResponse = {
  status: string;
  message: string;
  ticket?: UserTicket;
};

type ConsumeTicketResponse = {
  status: string;
  message: string;
};

type TokenGetter = () => Promise<{
  access_token: string | null;
  idToken: string | null;
}>;

export const useTickets = (getTokens: TokenGetter) => {
  const {
    tickets,
    loading,
    error,
    setTickets,
    addTicket,
    setLoading,
    setError,
  } = useTicketsStore();

  const apiClient = EVENTS_BASE_URL
    ? createApiClient({
        baseUrl: EVENTS_BASE_URL,
        getTokens,
      })
    : null;

  const fetchTickets = useCallback(async () => {
    if (!apiClient) {
      setError("Missing events API base URL.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<TicketsResponse>("tickets");
      setTickets(response.user_tickets ?? []);
    } catch (err: any) {
      const message =
        err?.payload?.message ?? err?.message ?? "Failed to fetch tickets.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiClient, setTickets, setLoading, setError]);

  const purchaseTicket = useCallback(
    async (eventId: string) => {
      if (!apiClient) {
        throw new Error("Missing events API base URL.");
      }

      const response = await apiClient.post<PurchaseTicketResponse>(
        "tickets/buy",
        {
          body: { event_id: eventId },
        }
      );

      // If the API returns the new ticket, add it to the store
      if (response.ticket) {
        addTicket(response.ticket);
      } else {
        // Otherwise, refetch all tickets
        await fetchTickets();
      }

      return response;
    },
    [apiClient, addTicket, fetchTickets]
  );

  const consumeTicket = useCallback(
    async (ticketId: string) => {
      if (!apiClient) {
        throw new Error("Missing events API base URL.");
      }

      const response = await apiClient.post<ConsumeTicketResponse>(
        `tickets/${ticketId}/verify`,
        {}
      );

      // Refetch tickets to update the is_used status
      await fetchTickets();

      return response;
    },
    [apiClient, fetchTickets]
  );

  const hasTicketForEvent = useCallback(
    (eventId: string) => {
      return tickets.some((ticket) => ticket.event_id === eventId);
    },
    [tickets]
  );

  const getTicketForEvent = useCallback(
    (eventId: string) => {
      return tickets.find((ticket) => ticket.event_id === eventId);
    },
    [tickets]
  );

  return {
    tickets,
    loading,
    error,
    fetchTickets,
    purchaseTicket,
    consumeTicket,
    hasTicketForEvent,
    getTicketForEvent,
  };
};
