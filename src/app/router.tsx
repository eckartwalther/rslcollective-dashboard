import { createBrowserRouter, Navigate } from "react-router-dom";
import { AuthRedirectPage } from "../pages/AuthRedirectPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { LogoutPage } from "../pages/LogoutPage";
import { RegisterPage } from "../pages/RegisterPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthRedirectPage />
  },
  {
    path: "/login/*",
    element: <LoginPage />
  },
  {
    path: "/register/*",
    element: <RegisterPage />
  },
  {
    path: "/logout",
    element: <LogoutPage />
  },
  {
    path: "/dashboard/*",
    element: <DashboardPage />
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />
  }
]);
