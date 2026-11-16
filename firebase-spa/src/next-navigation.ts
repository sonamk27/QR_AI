import { useLocation, useNavigate } from "react-router-dom";

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    refresh: () => navigate(0),
  };
}

export function usePathname() {
  return useLocation().pathname;
}
