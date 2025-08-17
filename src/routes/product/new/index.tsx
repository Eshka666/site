import {
  component$,
  useSignal,
  $,
  noSerialize,
  type NoSerialize,
  useTask$,
} from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { supabase } from "~/lib/supabase";

const generateSlug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

type Category = {
  id: string;
  name: string;
  slug: string;
};

export default component$(() => {
  const nav = useNavigate();
  const name = useSignal("");
  const currency = useSignal("BYN");
  const price = useSignal("");
  const description = useSignal("");
  const imageFile = useSignal<NoSerialize<File> | null>(null);
  const loading = useSignal(false);
  const error = useSignal("");

  const categories = useSignal<Category[]>([]);
  const selectedCategory = useSignal("new");
  const newCategoryName = useSignal("");

  useTask$(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug")
      .order("name");

    if (!error && data) {
      categories.value = data as Category[];
    }
  });

  const handleInputChange = (
    signal:
      | typeof name
      | typeof description
      | typeof price
      | typeof newCategoryName
  ) =>
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
      let categoryId = "";

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

      // Обрабатываем категорию
      if (selectedCategory.value === "new") {
        if (!newCategoryName.value.trim()) {
          throw new Error("Введите название новой категории");
        }

        const categorySlug = generateSlug(newCategoryName.value);

        let uniqueSlug = categorySlug;
        let count = 1;

        while (true) {
          const { data: existingCategory } = await supabase
            .from("categories")
            .select("id")
            .eq("slug", uniqueSlug)
            .maybeSingle();

          if (!existingCategory) {
            break;
          }

          uniqueSlug = `${categorySlug}-${count++}`;
        }

        const { data: newCat, error: catError } = await supabase
          .from("categories")
          .insert([{ name: newCategoryName.value, slug: uniqueSlug }])
          .select("id")
          .single();

        if (catError) throw new Error("Ошибка категории: " + catError.message);

        categoryId = newCat.id;
      } else {
        categoryId = selectedCategory.value;
      }

      // Генерация уникального slug для товара
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

      // Вставляем новый товар
      const { data: inserted, error: insertError } = await supabase
        .from("products")
        .upsert([
          {
            name: name.value,
            slug,
            description: description.value,
            image_url: imageUrl,
            price: parseFloat(price.value),
            currency: currency.value,
            category_id: categoryId,
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
          <label class="block text-sm font-medium">Название:</label>
          <input
            type="text"
            value={name.value}
            onInput$={handleInputChange(name)}
            required
            class="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label class="block text-sm font-medium">Описание:</label>
          <textarea
            value={description.value}
            onInput$={handleInputChange(description)}
            class="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label class="block text-sm font-medium">Категория:</label>
          <select
            value={selectedCategory.value}
            onChange$={(e) =>
              (selectedCategory.value = (e.target as HTMLSelectElement).value)
            }
            class="mt-1 block w-full border rounded-md p-2"
          >
            <option value="new">➕ Создать новую категорию</option>
            {categories.value.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {selectedCategory.value === "new" && (
          <div>
            <label class="block text-sm font-medium">Новая категория:</label>
            <input
              type="text"
              value={newCategoryName.value}
              onInput$={handleInputChange(newCategoryName)}
              placeholder="Например: Электроника"
              class="mt-1 block w-full border rounded-md p-2"
            />
          </div>
        )}

        <div>
          <label class="block text-sm font-medium">Картинка:</label>
          <input
            type="file"
            accept="image/*"
            onChange$={onFileChange}
            class="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label class="block text-sm font-medium">Цена:</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price.value}
            onInput$={handleInputChange(price)}
            required
            class="mt-1 block w-full border rounded-md p-2"
          />
        </div>

        <div>
          <label class="block text-sm font-medium">Валюта:</label>
          <select
            value={currency.value}
            onChange$={(e) =>
              (currency.value = (e.target as HTMLSelectElement).value)
            }
            class="mt-1 block w-full border rounded-md p-2"
          >
            <option value="BYN">BYN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
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
