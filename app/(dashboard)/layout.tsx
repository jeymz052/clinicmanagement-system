import Layout from "@/src/components/layout/Layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout role="ADMIN">{children}</Layout>;
}
