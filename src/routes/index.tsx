// import { component$, useSignal, useTask$ } from "@builder.io/qwik";
// import { Link } from "@builder.io/qwik-city";
// import { supabase } from "~/lib/supabase";

// type Product = {
//   id: string;
//   name: string;
//   slug: string;
// };

// export default component$(() => {
//   const products = useSignal<Product[]>([]);

//   useTask$(async () => {
//     const { data, error } = await supabase
//       .from("products")
//       .select("id, name, slug");

//     if (error || !data) return;

//     products.value = data as Product[];
//   });

//   return (
//     <div style={{ padding: "20px" }}>
//       <h1>Список товаров</h1>
//       <Link href="/product/new">➕ Добавить новый товар</Link>

//       <div style={{ marginTop: "20px" }}>
//         <h2>Без категории</h2>
//         <ul>
//           {products.value.map((product) => (
//             <li key={product.id}>
//               <Link href={`/product/${product.slug}`}>{product.name}</Link>
//             </li>
//           ))}
//         </ul>
//       </div>
//     </div>
//   );
// });

import { component$ } from "@builder.io/qwik";
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
          <h2>Main Content</h2>
        </main>
      </div>
      <footer class="bg-gray-800 text-white p-4 mt-4">
        <p>Footer</p>
      </footer>
    </div>
  );
});
