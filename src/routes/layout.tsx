import { component$, Slot } from "@builder.io/qwik";
import Sidebar from "~/components/Sidebar";

export default component$(() => {
  return (
    <div class="flex flex-col min-h-screen">
      <header class="bg-gray-800 text-white p-4">
        <h1>Header</h1>
      </header>
      <div class="flex flex-1">
        <aside class="bg-gray-200 w-1/4 p-4 border-r">
          <Sidebar />
        </aside>
        <main class="flex-1 p-4">
          <Slot />
        </main>
      </div>
      <footer class="bg-gray-800 text-white p-4 mt-4">
        <p>Footer</p>
      </footer>
    </div>
  );
});
