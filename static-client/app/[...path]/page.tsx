import StaticApp from "../StaticApp";

export function generateStaticParams() {
  return [
    { path: ["login"] },
    { path: ["signup"] },
    { path: ["verify-email"] },
    { path: ["dashboard"] },
    { path: ["super-admin"] },
  ];
}

export default function StaticPathPage() {
  return <StaticApp />;
}
