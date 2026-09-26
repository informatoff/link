# Установка Link

Link запускается через Node.js CLI. Установщик собирает пакеты из локального checkout и добавляет команду `link` в пользовательский `PATH` без прав администратора.

## Требования

- Node.js 20 или новее.
- npm, который устанавливается вместе с Node.js.
- Исходники Link: распакованный архив или checkout репозитория.
- Интернет во время установки, чтобы npm мог загрузить зависимости.

Установщик не является подписанным MSI/PKG/DEB-пакетом и не скачивает исходники сам. Он создает launcher, который запускает CLI из указанной папки проекта. Не перемещайте checkout после установки; если переместили, запустите installer повторно.

## Windows

Откройте PowerShell в корне распакованного проекта и выполните:

```powershell
powershell -ExecutionPolicy Bypass -File .\website\downloads\install.ps1
```

Если installer скачан отдельно с сайта, укажите путь к checkout:

```powershell
powershell -ExecutionPolicy Bypass -File "$HOME\Downloads\install.ps1" -SourceDirectory "C:\src\link"
```

Скрипт выполнит `npm install`, `npm run build`, создаст `%LOCALAPPDATA%\Programs\Link\bin\link.cmd` и добавит эту папку в пользовательский `PATH`. Переменная `PATH` текущего PowerShell обновляется сразу; новые терминалы также получат ее при запуске.

Проверьте установку:

```powershell
link --help
link check .\examples\hello-world.lk
link run .\examples\hello-world.lk
```

Удаление launcher и записи PATH:

```powershell
powershell -ExecutionPolicy Bypass -File .\website\downloads\install.ps1 -Uninstall
```

Исходный проект и его файлы при удалении остаются нетронутыми.

## macOS и Linux

Откройте Terminal в корне распакованного проекта и выполните:

```sh
bash ./website/downloads/install.sh
```

Если installer скачан отдельно, передайте путь к checkout:

```sh
bash ~/Downloads/install.sh --source "$HOME/src/link"
```

Скрипт собирает проект, помещает launcher в `~/.local/bin/link` и добавляет `~/.local/bin` в конфигурацию текущей оболочки: `.zprofile` для zsh, `.bashrc` для bash или `.profile` для других оболочек.

Проверьте установку в текущем терминале:

```sh
link --help
link check examples/hello-world.lk
link run examples/hello-world.lk
```

Если новый PATH еще не подхватился, откройте новый терминал или выполните для bash:

```sh
source ~/.bashrc
```

Для zsh:

```sh
source ~/.zprofile
```

Удаление launcher и добавленной установщиком строки PATH:

```sh
bash ./website/downloads/install.sh --uninstall
```

Checkout проекта при этом не удаляется.

## Запуск Telegram-бота

Задайте токен только в окружении, не записывайте его в `.lk`-файл.

PowerShell:

```powershell
$env:TG_TOKEN = "ВАШ_ТОКЕН"
link run .\examples\simple-telegram-bot.lk
```

macOS/Linux:

```sh
export TG_TOKEN="ВАШ_ТОКЕН"
link run examples/simple-telegram-bot.lk
```

Для уведомлений о заказах в примере магазина задайте также `SHOP_ADMIN_CHAT_ID`, затем запустите `examples/telegram-shop.lk`.

## Частые проблемы

### `link` не найден

Откройте новый терминал. Проверьте, что `%LOCALAPPDATA%\Programs\Link\bin` на Windows или `~/.local/bin` на macOS/Linux присутствует в пользовательском `PATH`. Если checkout перемещался, повторите установку из новой папки.

### Установщик сообщает, что Node.js слишком старый

Установите Node.js 20 LTS или новее и перезапустите терминал, чтобы он увидел новый `node` и `npm`.

### PowerShell запрещает запуск скрипта

Используйте `-ExecutionPolicy Bypass` в команде установки. Это действует только на текущий запуск PowerShell и не меняет системную политику.
