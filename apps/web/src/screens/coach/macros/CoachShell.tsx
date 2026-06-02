import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

/** Coach layout: the active screen (its own scroll/padding) plus the persistent bottom nav. */
export function CoachShell() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}
