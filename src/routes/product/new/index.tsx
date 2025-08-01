import {
  component$,
  useSignal,
  $,
  noSerialize,
  type NoSerialize,
} from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";

const generateSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default component$(() => {
  const nav = useNavigate();

  const name = useSignal("");
  const currency = useSignal("BYN");
  const price = useSignal("");
  const description = useSignal("");
  const imageFile = useSignal<NoSerialize<File> | null>(null);
  const loading = useSignal(false);
  const error = useSignal("");

  const handleInputChange = (signal: typeof name | typeof description) =>
    $((e: Event) => {
      signal.value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
    });

  const onFileChange = $((e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0] || null;
    imageFile.value = file ? noSerialize(file) : null;
  });

  const onSubmit = $(async (e: Event) => {
    e.preventDefault();
    error.value = "";
    loading.value = true;

    try {
      let imageUrl = "";

      if (imageFile.value) {
        const ext = imageFile.value.name.split(".").pop();
        const fileName = `${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, imageFile.value);

        if (uploadError)
          throw new Error("Ошибка загрузки: " + uploadError.message);

        imageUrl = supabase.storage
          .from("product-images")
          .getPublicUrl(fileName).data.publicUrl;
      }

      const baseSlug = generateSlug(name.value);
      let slug = baseSlug;
      let count = 1;

      while (true) {
        const { data, error: slugError } = await supabase
          .from("products")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (slugError) throw new Error("Проверка slug: " + slugError.message);
        if (!data) break;

        slug = `${baseSlug}-${count++}`;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("products")
        .insert([
          {
            name: name.value,
            slug,
            description: description.value,
            image_url: imageUrl,
            price: parseFloat(price.value),
            currency: currency.value,
          },
        ])
        .select("id, slug")
        .single();

      if (insertError) throw new Error(insertError.message);

      if (inserted) {
        nav(`/product/${inserted.slug}/`);
      }
    } catch (err) {
      error.value = (err as Error).message;
    } finally {
      loading.value = false;
    }
  });

  return (
    <div class="max-w-2xl mx-auto p-6">
      <h1 class="text-3xl font-semibold mb-6">Добавить новый товар</h1>
      <form preventdefault:submit onSubmit$={onSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">
            Название:
          </label>
          <input
            type="text"
            value={name.value}
            onInput$={handleInputChange(name)}
            required
            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">
            Описание:
          </label>
          <textarea
            value={description.value}
            onInput$={handleInputChange(description)}
            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">
            Картинка:
          </label>
          <input
            type="file"
            accept="image/*"
            onChange$={onFileChange}
            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Цена:</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price.value}
            onInput$={handleInputChange(price)}
            required
            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Валюта:</label>
          <select
            value={currency.value}
            onChange$={(e) =>
              (currency.value = (e.target as HTMLSelectElement).value)
            }
            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
          >
            <option value="BYN">BYN (белорусские рубли)</option>
            <option value="USD">USD (доллары)</option>
            <option value="EUR">EUR (евро)</option>
          </select>
        </div>
        {error.value && <p class="text-red-500 text-sm">{error.value}</p>}
        <button
          type="submit"
          disabled={loading.value}
          class="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading.value ? "Сохраняем..." : "Сохранить"}
        </button>
      </form>

      <button
        onClick$={() => nav(-1)}
        class="mt-6 w-full text-center bg-gray-200 p-2 rounded-md hover:bg-gray-300"
      >
        Назад
      </button>
    </div>
  );
});
