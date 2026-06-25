import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { AppErrorPage } from "../pages/AppErrorPage";
import { AuthRedirectPage } from "../pages/AuthRedirectPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { LogoutPage } from "../pages/LogoutPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RegisterPage } from "../pages/RegisterPage";

const routeErrorElement = <AppErrorPage />;

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AuthRedirectPage />,
    errorElement: routeErrorElement
  },
  {
    path: "/login/*",
    element: <LoginPage />,
    errorElement: routeErrorElement
  },
  {
    path: "/register/*",
    element: <RegisterPage />,
    errorElement: routeErrorElement
  },
  {
    path: "/logout",
    element: <LogoutPage />,
    errorElement: routeErrorElement
  },
  {
    path: "/dashboard/*",
    element: <DashboardPage />,
    errorElement: routeErrorElement
  },
  {
    path: "/admin/users",
    element: <DashboardPage />,
    errorElement: routeErrorElement
  },
  {
    path: "/admin/users/:id",
    element: <DashboardPage />,
    errorElement: routeErrorElement
  },
  {
    path: "*",
    element: <NotFoundPage />,
    errorElement: routeErrorElement
  }
];

export const router = createBrowserRouter(appRoutes);
