// src/components/ProductDetail.tsx
import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  price: number;
  currency: string;
}

export default component$(() => {
  const loc = useLocation();
  const slug = loc.params.slug;

  const product = useSignal<Product | null>(null);

  useTask$(async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .single();

    product.value = data;
  });

  if (!product.value) {
    return <div>Товар не найден</div>;
  }

  return (
    <div class="p-6">
      <h1 class="text-3xl font-semibold">{product.value.name}</h1>
      <img
        src={product.value.image_url}
        alt={product.value.name}
        width={100}
        height={100}
        class="w-48 h-48 object-cover mt-4"
      />
      <p class="mt-4">{product.value.description}</p>
      <p class="mt-4 text-lg font-bold">
        Цена: {product.value.price} {product.value.currency}
      </p>
      <h2 class="mt-4 text-xl font-semibold">QR-код</h2>
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://your-site-url/product/${slug}`}
        alt="QR Code"
        class="mt-2"
        width={100}
        height={100}
      />
      <p class="text-xs text-gray-500 mt-2">
        Отсканируйте, чтобы открыть товар
      </p>

      <button
        onClick$={() => history.back()}
        class="mt-6 bg-gray-200 p-2 rounded-md hover:bg-gray-300"
      >
        Назад
      </button>
    </div>
  );
});
