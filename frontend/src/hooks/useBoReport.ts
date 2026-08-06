import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSoExclude,
  deleteSoExclude,
  fetchFolders,
  fetchSoExclude,
  processOrderItemPrice,
  processPartviz,
  processProgressSource,
  processReport,
  updateSoExclude,
  type OrderItemPriceProcessPayload,
  type PartvizProcessPayload,
  type ProgressSourceProcessPayload,
  type ProcessPayload,
  type SoExcludePayload,
} from "../api/boReport";

export function useFolders() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: fetchFolders,
  });
}

export function useSoExclude() {
  return useQuery({
    queryKey: ["so-exclude"],
    queryFn: fetchSoExclude,
  });
}

export function useCreateSoExclude() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SoExcludePayload) => createSoExclude(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["so-exclude"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useUpdateSoExclude() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      soNumber,
      payload,
    }: {
      soNumber: string;
      payload: SoExcludePayload;
    }) => updateSoExclude(soNumber, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["so-exclude"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useDeleteSoExclude() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (soNumber: string) => deleteSoExclude(soNumber),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["so-exclude"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
}

export function useProcessReport() {
  return useMutation({
    mutationFn: (payload: ProcessPayload) => processReport(payload),
  });
}

export function useProcessPartviz() {
  return useMutation({
    mutationFn: (payload: PartvizProcessPayload) => processPartviz(payload),
  });
}

export function useProcessOrderItemPrice() {
  return useMutation({
    mutationFn: (payload: OrderItemPriceProcessPayload) =>
      processOrderItemPrice(payload),
  });
}

export function useProcessProgressSource() {
  return useMutation({
    mutationFn: (payload: ProgressSourceProcessPayload) =>
      processProgressSource(payload),
  });
}
