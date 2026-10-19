import type { UiLanguage } from "./languages";
const en = { displayMode: "Display mode", viewMasonry: "Masonry", viewGrid: "Grid", viewList: "List", lastViewed: "Last viewed", dateModified: "Modified", dateCreated: "Created", folderItems: "{count} items" };
export type DisplayTranslationKey = keyof typeof en;
const row = (displayMode: string, viewMasonry: string, viewGrid: string, viewList: string, lastViewed: string, dateModified: string, dateCreated: string, folderItems: string): Record<DisplayTranslationKey, string> => ({ displayMode, viewMasonry, viewGrid, viewList, lastViewed, dateModified, dateCreated, folderItems });
export const DISPLAY_TRANSLATIONS: Record<UiLanguage, Record<DisplayTranslationKey, string>> = {
  en,
  "zh-TW": row("顯示方式", "瀑布", "網格", "列表", "上次瀏覽", "更新", "建立", "{count} 個項目"),
  "zh-CN": row("显示方式", "瀑布", "网格", "列表", "上次浏览", "更新", "创建", "{count} 个项目"),
  ja: row("表示形式", "メーソンリー", "グリッド", "リスト", "最終閲覧", "更新日", "作成日", "{count} 項目"),
  ko: row("표시 방식", "벽돌식", "격자", "목록", "최근 열람", "수정일", "생성일", "항목 {count}개"),
  de: row("Ansicht", "Mauerwerk", "Raster", "Liste", "Zuletzt angesehen", "Geändert", "Erstellt", "{count} Elemente"),
  es: row("Vista", "Mosaico", "Cuadrícula", "Lista", "Última visita", "Modificado", "Creado", "{count} elementos"),
  fr: row("Affichage", "Mosaïque", "Grille", "Liste", "Dernière visite", "Modifié", "Créé", "{count} éléments"),
  it: row("Visualizzazione", "Mosaico", "Griglia", "Elenco", "Ultima visita", "Modificato", "Creato", "{count} elementi"),
  "pt-BR": row("Visualização", "Mosaico", "Grade", "Lista", "Última visita", "Modificado", "Criado", "{count} itens"),
  ru: row("Вид", "Мозаика", "Сетка", "Список", "Последний просмотр", "Изменено", "Создано", "Элементов: {count}"),
  uk: row("Вигляд", "Мозаїка", "Сітка", "Список", "Останній перегляд", "Змінено", "Створено", "Елементів: {count}"),
  nl: row("Weergave", "Metselwerk", "Raster", "Lijst", "Laatst bekeken", "Gewijzigd", "Aangemaakt", "{count} items"),
  pl: row("Widok", "Mozaika", "Siatka", "Lista", "Ostatnio oglądane", "Zmieniono", "Utworzono", "Elementy: {count}"),
  tr: row("Görünüm", "Duvar", "Izgara", "Liste", "Son görüntüleme", "Değiştirilme", "Oluşturulma", "{count} öğe"),
  id: row("Tampilan", "Susunan bata", "Kisi", "Daftar", "Terakhir dilihat", "Diubah", "Dibuat", "{count} item"),
  vi: row("Chế độ hiển thị", "Xếp gạch", "Lưới", "Danh sách", "Xem gần nhất", "Sửa đổi", "Tạo", "{count} mục"),
  th: row("รูปแบบการแสดง", "เรียงอิสระ", "ตาราง", "รายการ", "ดูล่าสุด", "แก้ไข", "สร้าง", "{count} รายการ"),
};
