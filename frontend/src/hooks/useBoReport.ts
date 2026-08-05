import { useMutation, useQuery } from "@tanstack/react-query";
import {
  fetchFolders,
  processOrderItemPrice,
  processPartviz,
  processProgressSource,
  processReport,
  type OrderItemPriceProcessPayload,
  type PartvizProcessPayload,
  type ProgressSourceProcessPayload,
  type ProcessPayload,
} from "../api/boReport";

export function useFolders() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: fetchFolders,
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
