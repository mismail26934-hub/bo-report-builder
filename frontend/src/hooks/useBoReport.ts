import { useMutation, useQuery } from "@tanstack/react-query";
import {
  fetchFolders,
  processPartviz,
  processReport,
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
