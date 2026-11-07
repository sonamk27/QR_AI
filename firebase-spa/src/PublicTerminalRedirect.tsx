import { Navigate, useParams } from "react-router-dom";

export default function PublicTerminalRedirect() {
  const { slug = "" } = useParams();
  return <Navigate to={`/r/${encodeURIComponent(slug)}/loyalty`} replace />;
}
