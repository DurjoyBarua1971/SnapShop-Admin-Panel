import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface AuthUser {
  id: number;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();

  const { data: userData, isLoading } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await fetch("https://dummyjson.com/auth/me", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem(
            "accessTokenSnapShopAdminPanel"
          )}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }
      return response.json();
    },
    retry: false,
    staleTime: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
    enabled: !!localStorage.getItem("accessTokenSnapShopAdminPanel"),
  });

  useEffect(() => {
    setUser(userData || null);
  }, [userData]);

  const loginMutation = useMutation({
    mutationFn: async ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => {
      const response = await fetch("https://dummyjson.com/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          expiresInMins: 1440,
        }),
        //credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Login failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem(
        "accessTokenSnapShopAdminPanel",
        data.accessToken
      );
      localStorage.setItem("refreshToken", data.refreshToken);
      setUser(data.user);
      queryClient.setQueryData(["authUser"], data.user);
      const redirectTo = location.state?.from || "/";
      navigate(redirectTo, { replace: true });
    },
  });

  const logout = () => {
    setUser(null);
    localStorage.removeItem("accessTokenSnapShopAdminPanel");
    localStorage.removeItem("refreshToken");
    queryClient.removeQueries({ queryKey: ["authUser"] });
    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login: async (username: string, password: string) => {
          return await loginMutation.mutateAsync({ username, password });
        },
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
