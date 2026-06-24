import { ClerkProvider } from "@clerk/react";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { theme } from "./theme";

type AppProvidersProps = {
  children: ReactNode;
};

type ClerkAuthCopyMode = "signIn" | "signUp";

const ClerkAuthCopyModeContext = createContext<(mode: ClerkAuthCopyMode) => void>(() => undefined);

function initialClerkAuthCopyMode(): ClerkAuthCopyMode {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/register")) {
    return "signUp";
  }

  return "signIn";
}

function clerkLocalizationFor(mode: ClerkAuthCopyMode) {
  const socialAction =
    mode === "signUp" ? "Sign up with {{provider|titleize}}" : "Sign in with {{provider|titleize}}";

  return {
    socialButtonsBlockButton: socialAction,
    socialButtonsBlockButtonManyInView: socialAction,
    signIn: {
      start: {
        title: "Sign in to your account",
        titleCombined: "Sign in to your account",
        subtitle: "",
        subtitleCombined: ""
      }
    },
    signUp: {
      start: {
        title: "Create your RSL Collective account",
        titleCombined: "Create your RSL Collective account",
        subtitle: "",
        subtitleCombined: ""
      }
    }
  };
}

export function useClerkAuthCopyMode(mode: ClerkAuthCopyMode) {
  const setMode = useContext(ClerkAuthCopyModeContext);

  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);
}

export function AppProviders({ children }: AppProvidersProps) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const [clerkAuthCopyMode, setClerkAuthCopyMode] = useState<ClerkAuthCopyMode>(initialClerkAuthCopyMode);
  const clerkLocalization = useMemo(
    () => clerkLocalizationFor(clerkAuthCopyMode),
    [clerkAuthCopyMode]
  );
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false
          },
          mutations: {
            retry: false
          }
        }
      })
  );

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/login"
      signUpUrl="/register"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/login"
      localization={clerkLocalization}
    >
      <ClerkAuthCopyModeContext.Provider value={setClerkAuthCopyMode}>
        <QueryClientProvider client={queryClient}>
          <MantineProvider theme={theme} defaultColorScheme="light">
            {children}
          </MantineProvider>
        </QueryClientProvider>
      </ClerkAuthCopyModeContext.Provider>
    </ClerkProvider>
  );
}
