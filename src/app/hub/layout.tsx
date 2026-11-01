import HubShell from "@/components/hub/HubShell";

export default function HubLayout({ children }: LayoutProps<"/hub">) {
  return <HubShell>{children}</HubShell>;
}
