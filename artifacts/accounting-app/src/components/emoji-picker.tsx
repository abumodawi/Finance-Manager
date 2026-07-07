import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  {
    name: "مال وبنوك",
    emojis: ["💰", "💳", "🏦", "💵", "💴", "💶", "💷", "💸", "💎", "🪙", "🧾", "📈", "📉", "📊", "🏧", "💹", "🤑", "💲", "🏷️", "🪝", "📇", "🗃️"],
  },
  {
    name: "طعام وشراب",
    emojis: ["🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🥙", "🧆", "🥩", "🍗", "🍖", "🥗", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥘", "🛒", "🛍️", "☕", "🍵", "🥤", "🧃", "🍹", "🍺", "🍎", "🍌", "🍇", "🍓", "🥑", "🍰", "🍩", "🍪", "🍫", "🍦", "🧁", "🥐"],
  },
  {
    name: "نقل ومواصلات",
    emojis: ["🚗", "🚙", "🚕", "🏎️", "🚓", "🚑", "🚒", "🚌", "🚎", "🚐", "🛻", "🚚", "🚛", "⛽", "🔋", "🅿️", "🚏", "✈️", "🛫", "🛬", "🚆", "🚄", "🚈", "🚇", "🚊", "🚲", "🛵", "🏍️", "🛴", "🚁", "⛵", "🚤", "🛳️", "🚢", "🚉", "🗺️"],
  },
  {
    name: "منزل وفواتير",
    emojis: ["🏠", "🏡", "🏢", "🏬", "🏘️", "🛋️", "🛏️", "🚪", "🪑", "🚿", "🛁", "🚽", "💡", "🔌", "🔋", "💧", "🚰", "🔥", "❄️", "🧹", "🧺", "🧼", "🧴", "🧯", "🔧", "🔨", "🪛", "🪜", "🔑", "🗝️", "📶", "📡", "📺", "☎️", "🖨️", "🪴"],
  },
  {
    name: "صحة ورياضة",
    emojis: ["🏥", "💊", "💉", "🩺", "🩹", "⚕️", "🦷", "👓", "🕶️", "🩻", "🧬", "🌡️", "🏋️", "🤸", "🧘", "🏃", "🚴", "🏊", "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🥊", "🥋", "⛹️", "🤾", "🏓", "🏸", "🥅", "🏆"],
  },
  {
    name: "تسوق وملابس",
    emojis: ["🛍️", "👕", "👔", "👗", "👚", "👖", "🧥", "🧴", "🧦", "🧣", "🧤", "🎽", "👟", "👞", "👠", "👡", "👢", "🥿", "👜", "👛", "🎒", "💼", "👒", "🧢", "🎩", "💄", "💍", "⌚", "🕰️", "🧳", "🪞", "🪒"],
  },
  {
    name: "تعليم وعمل",
    emojis: ["📚", "📖", "📝", "✏️", "🖊️", "🖋️", "📐", "📏", "🎓", "🏫", "🔬", "🔭", "🧪", "🌐", "💻", "🖥️", "⌨️", "🖱️", "📱", "☎️", "📞", "📠", "🖨️", "📎", "📌", "📋", "🗂️", "📁", "🗓️", "📅", "🏢", "💼"],
  },
  {
    name: "ترفيه وسفر",
    emojis: ["🎮", "🕹️", "🎬", "🎥", "🍿", "🎉", "🎊", "🎈", "🎁", "🎫", "🎟️", "🎵", "🎶", "🎸", "🎹", "🎤", "🎧", "🥁", "🎨", "🎭", "🎪", "🎳", "🎯", "🎲", "♟️", "🧩", "🏖️", "🏝️", "⛱️", "🏕️", "🗿", "🎡", "🎢", "🎠", "🧳", "📷"],
  },
  {
    name: "عائلة وأشخاص",
    emojis: ["👶", "🧒", "👦", "👧", "👨", "👩", "🧑", "👴", "👵", "👨‍👩‍👧‍👦", "👨‍👩‍👧", "👪", "🤰", "🍼", "🐶", "🐱", "🐟", "🐦", "🎂", "💐", "🌹", "🎀", "💝", "💒", "💌", "🤝", "🙏", "❤️", "⭐", "🌙", "☀️", "🌈"],
  },
  {
    name: "متنوع",
    emojis: ["🎯", "🔔", "🔕", "⏰", "⏳", "🔒", "🔓", "🗑️", "♻️", "⚙️", "🧰", "🪫", "🔦", "🕯️", "📦", "✉️", "📮", "🏷️", "📍", "🧭", "⚖️", "🛡️", "⚡", "💥", "✨", "🌟", "❓", "❗", "✅", "❌", "➕", "➖"],
  },
];

export function EmojiPicker({ 
  value, 
  onChange,
  className 
}: { 
  value?: string; 
  onChange: (emoji: string) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={cn("w-12 h-12 p-0 text-xl flex items-center justify-center shrink-0", className)}
        >
          {value || "🙂"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="h-64 overflow-y-auto pr-2 space-y-4">
          {EMOJI_CATEGORIES.map((category) => (
            <div key={category.name}>
              <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">
                {category.name}
              </div>
              <div className="grid grid-cols-6 gap-1">
                {category.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onChange(emoji)}
                    className="h-8 w-8 rounded flex items-center justify-center text-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
