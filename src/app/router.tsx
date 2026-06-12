import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardPage } from "../pages/DashboardPage";

export const router = createBrowserRouter([
  {
    path: "/dashboard/*",
    element: <DashboardPage />
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />
  }
]);
