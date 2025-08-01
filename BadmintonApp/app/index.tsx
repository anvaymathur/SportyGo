import { useEffect } from "react";
import { router } from "expo-router";

export default function Index() {
  useEffect(() => {
    // Immediate navigation to EventsList
    router.replace("/EventsList");
  }, []);

  return null;
}
