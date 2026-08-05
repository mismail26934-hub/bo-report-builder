import { useMutation, useQuery } from "@tanstack/react-query";
import {
  fetchFolders,
  processOrderItemPrice,
  processPartviz,
  processReport,
  type OrderItemPriceProcessPayload,
  type PartvizProcessPayload,
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
