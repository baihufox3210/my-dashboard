import { unlock } from './achievements'

// A tiny text adventure for people who open DevTools, after Google's own: type play()
// in the Console, then bare words like north, look or take (they are getters, so no
// parentheses are needed).
type Room = 'gate' | 'bamboo' | 'shrine' | 'pond'

const rooms: Record<Room, { title: string; text: string; exits: Partial<Record<'north' | 'south' | 'east' | 'west', Room>> }> = {
  gate: { title: '鳥居前', text: '一座朱紅色的鳥居。北邊是竹林，東邊傳來水聲。', exits: { north: 'bamboo', east: 'pond' } },
  bamboo: { title: '竹林', text: '風吹過竹林沙沙作響。地上好像有什麼東西……北邊隱約可見一座小神社。', exits: { south: 'gate', north: 'shrine' } },
  pond: { title: '池塘', text: '池水清澈，倒映著月亮。一塊石頭上刻著：「白狐喜歡油豆腐」。', exits: { west: 'gate' } },
  shrine: { title: '稻荷神社', text: '小小的神社前，一雙藍色的眼睛在暗處看著你。', exits: { south: 'bamboo' } },
}

const style = { title: 'color:#b4774f;font-weight:700;font-size:14px', text: 'color:inherit;font-size:12px', hint: 'color:#9c8a78;font-size:11px', win: 'color:#3f7d58;font-weight:700;font-size:14px' }

export function installConsoleAdventure() {
  const globals = window as unknown as Record<string, unknown>
  if (globals.play) return
  let room: Room = 'gate'
  let hasTofu = false
  let started = false
  let finished = false

  const say = (text: string, css = style.text) => console.log(`%c${text}`, css)
  const describe = () => {
    say(`📍 ${rooms[room].title}`, style.title)
    say(rooms[room].text)
    say(`出口：${Object.keys(rooms[room].exits).join('、')}\u3000｜\u3000指令：look、north、south、east、west、take、give、inventory、help`, style.hint)
  }
  const go = (direction: 'north' | 'south' | 'east' | 'west') => {
    if (!started) return say('先輸入 play() 開始冒險。', style.hint)
    const next = rooms[room].exits[direction]
    if (!next) return say('那邊沒有路。')
    room = next
    describe()
  }
  const commands: Record<string, () => void> = {
    look: () => started ? describe() : say('先輸入 play() 開始冒險。', style.hint),
    north: () => go('north'), south: () => go('south'), east: () => go('east'), west: () => go('west'),
    take: () => {
      if (room === 'bamboo' && !hasTofu) { hasTofu = true; return say('你撿起了一塊香噴噴的油豆腐 🍥（狐狸最愛的食物）') }
      say('這裡沒什麼能拿的。')
    },
    inventory: () => say(hasTofu ? '背包：油豆腐 🍥' : '背包：空空如也'),
    give: () => {
      if (room !== 'shrine') return say('這裡沒有人可以給。')
      if (!hasTofu) return say('白狐看了你一眼，又縮回暗處。也許該帶點牠喜歡的東西？')
      finished = true
      unlock('console')
      say('🦊 白狐叼走了油豆腐，蹭了蹭你的手。', style.win)
      say('牠留下一句話：「Code is cheap. Show me your prompt.」然後消失在月光裡。', style.win)
      say('恭喜通關！回到網頁上按 ` 打開終端機，還有更多彩蛋。', style.hint)
    },
    help: () => say('移動：north、south、east、west\u3000｜\u3000其他：look、take、give、inventory', style.hint),
  }
  globals.play = () => {
    // The command words only become globals once someone actually starts playing.
    for (const [name, run] of Object.entries(commands)) {
      Object.defineProperty(window, name, { configurable: true, get: () => { run(); return finished ? '🦊' : '…' } })
    }
    started = true
    room = 'gate'
    say('🌙 白狐的神社 —— 一段 Console 文字冒險', style.title)
    say('傳說月夜時，神社附近會出現一隻白狐。去找到牠吧。', style.text)
    describe()
    return '冒險開始！'
  }
}
