import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Drawer } from "../components/drawer";
import { SpacetimeProvider } from "../providers/spacetime-provider";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <SpacetimeProvider>
      <>
        <Drawer>
          <Outlet />
        </Drawer>

        <TanStackRouterDevtools position="bottom-right" />
      </>
    </SpacetimeProvider>
  );
}
