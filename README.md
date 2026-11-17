# order-site-infra

Учебный проект базовой инфраструктуры MVP системы обработки заказов на одном VPS с Ubuntu 22.04. Сервисы запускаются в Docker Compose. Часть 1 включает Nginx, pgAdmin, Docker Registry и автоматическое обновление помеченных контейнеров. Часть 2 добавляет frontend и backend-приложение.

## Состав проекта

```text
.
├── .env.example
├── .gitignore
├── README.md
├── docker-compose.yml
├── backend/
│   ├── core/
│   ├── models/
│   ├── routes/
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   ├── webpack.config.js
│   └── dist/             # результат сборки, в Git не хранится
├── nginx/
│   ├── conf.d/
│   │   └── default.conf
│   └── html/
│       └── index.html    # заглушка Части 1, с Части 2 не используется
└── registry/
    ├── auth/
    │   └── .gitkeep
    └── create-user.sh
```

Файл `.env` и `registry/auth/htpasswd` создаются при настройке и в репозитории не хранятся.

`backend/` содержит приложение FastAPI, модели базы и API-маршруты. `frontend/` содержит исходники сайта и каталог `dist/` со сборкой (в Git он не хранится). `nginx/` содержит конфигурацию Nginx и страницу-заглушку Части 1: с Части 2 Nginx раздаёт `frontend/dist`, заглушка не используется. `registry/` содержит скрипт создания пользователя и каталог для учётных данных Registry.

## Сетевые порты

Снаружи VPS опубликованы только порты Nginx:

| Порт | Назначение |
| --- | --- |
| `80` | Сайт и API через Nginx (в Части 1 — заглушка) |
| `5050` | pgAdmin 4 через прокси Nginx |
| `5000` | Docker Registry через прокси Nginx |

PostgreSQL, pgAdmin, Registry и Watchtower не публикуют собственные порты на хосте. Сервисы, к которым обращаются другие контейнеры, доступны через внутреннюю сеть Docker.

Требуются Docker и плагин docker compose. Скрипт registry/create-user.sh использует образ httpd:2, поэтому на сервере должен работать Docker.

## Запуск

Все команды ниже выполняются на VPS из корня проекта.

1. Создайте файл окружения и задайте собственные значения:

   ```bash
   cp .env.example .env
   nano .env
   ```

   Укажите свои значения для `POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_PASSWORD` и `PGADMIN_DEFAULT_EMAIL`. Не используйте `CHANGE_ME` в качестве пароля. Имена базы данных и пользователя PostgreSQL также задаются в этом файле.

2. Создайте пользователя Docker Registry. Скрипт запросит пароль интерактивно:

   ```bash
   bash registry/create-user.sh registry-user
   ```

   Вместо `registry-user` укажите выбранное имя. Скрипт запишет учётные данные в `registry/auth/htpasswd`.

3. Запустите сервисы и проверьте их состояние:

   ```bash
   docker compose up -d
   docker compose ps
   ```

## Часть 2: сайт и backend

Backend реализован на FastAPI, frontend — на JavaScript. Backend слушает порт `8000` только во внутренней сети Docker; секции `ports` у сервиса нет. Frontend собирается в `frontend/dist`, а готовые файлы раздаёт Nginx.

### Сборка и запуск

На компьютере нужны Node.js и npm. Из корня проекта соберите frontend:

```bash
cd frontend
npm install
npm run build
```

Передайте на сервер папку `backend`, собранную папку `frontend/dist` и файл `docker-compose.yml` в каталог проекта на сервере. Пример (`<ssh-имя-сервера>` замените на своё; если папки `frontend` на сервере нет, сначала создайте её командой `mkdir -p`):

```bash
scp -r backend <ssh-имя-сервера>:/root/order-site-infra/
scp -r frontend/dist <ssh-имя-сервера>:/root/order-site-infra/frontend/
scp docker-compose.yml <ssh-имя-сервера>:/root/order-site-infra/docker-compose.yml
```

При повторной сборке сначала удалите на сервере старую папку `frontend/dist/assets`, иначе там останутся файлы прежних сборок.

Перед запуском на сервере убедитесь, что там есть файл `.env` со значениями переменных из `.env.example`: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `PGADMIN_DEFAULT_EMAIL`, `PGADMIN_DEFAULT_PASSWORD`. На сервере из корня проекта выполните:

```bash
docker compose up -d --build backend
docker compose up -d nginx
```

### Доступность API и база данных

Через Nginx доступны только:

- `GET /api/admin-settings/` — список услуг и диапазонов бюджета;
- `POST /api/applications/` — отправка заявки.

Другие методы к этим двум адресам возвращают `403`, любой другой адрес `/api/` возвращает `404`. Документация Swagger (`/api/docs`) закрыта. Backend и PostgreSQL не доступны снаружи.

Backend при запуске создаёт таблицы:

- `admin_settings` — услуги и диапазоны бюджета;
- `applications` — заявки;
- `behavior_metrics` — метрики поведения посетителей (таблица создана, но пока не заполняется).

### Ограничения Части 2

- Работает только HTTP, HTTPS не настроен (домен отсутствует); пароли передаются открытым текстом.
- У сайта нет авторизации; форма не защищена от спама, backend не проверяет формат телефона и электронной почты.
- Порты `5050` и `5000` защищены только паролем.
- Сбор поведения посетителей не реализован.
- Версии Python-библиотек не закреплены; backend внутри контейнера запускается от имени `root`.
- Админ-страницы нет; запись и изменение услуг через Nginx закрыты, услуги можно добавлять только изнутри сервера.

## Проверка работы

- Откройте `http://<SERVER_IP>/` — должна отображаться страница «Студия Лучик» с формой заявки. Список услуг берётся из базы (таблица `admin_settings`). После отправки формы появляется сообщение «Заявка отправлена!», а в таблице `applications` (pgAdmin) — новая строка.
- Откройте `http://<SERVER_IP>:5050/` — появится форма входа pgAdmin. Используйте значения `PGADMIN_DEFAULT_EMAIL` и `PGADMIN_DEFAULT_PASSWORD` из `.env`.
- Проверьте API Registry с созданными учётными данными:

  ```bash
  curl -u registry-user http://<SERVER_IP>:5000/v2/_catalog
  ```

  `curl` запросит пароль; при успешной проверке ответ: {"repositories":[]}

- Если сервис не отвечает, проверьте `docker compose ps` и журналы сервисов командой `docker compose logs`.

## Файрвол UFW

Для доступа к VPS разрешите SSH и опубликованные порты Nginx:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 5050/tcp
sudo ufw allow 5000/tcp
sudo ufw status
```

Эти правила открывают порты `5050` и `5000` для всех IP-адресов, если доступ дополнительно не ограничен внешним файрволом.
Docker сам публикует порты контейнеров и может обходить правила ufw для них. Работу ufw для портов 5050 и 5000 мы отдельно не проверяли.

## Безопасность и ограничения

- Пароли и другие параметры окружения задаются в `.env`. Файлы `.env` и `registry/auth/htpasswd` исключены из Git через `.gitignore`; не добавляйте их в репозиторий.
- HTTPS в конфигурации нет: соединения работают по HTTP, поэтому логин и пароль передаются открытым текстом. Не используйте эти интерфейсы в недоверенной сети без дополнительной защиты.
- Порты `5050` (pgAdmin) и `5000` (Registry) опубликованы на всех интерфейсах VPS. Ограничьте доступ средствами сетевого файрвола, если он не должен быть общедоступным.
- Watchtower получает доступ к `/var/run/docker.sock`, что предоставляет ему широкие возможности управления Docker на хосте.
- Watchtower настроен с `WATCHTOWER_LABEL_ENABLE=true` и обновляет только контейнеры с меткой `com.centurylinklabs.watchtower.enable=true`. В текущем `docker-compose.yml` такая метка сервисам не назначена, поэтому контейнеры этого проекта не помечены для обновления.
- Backend работает во внутренней сети Docker и не публикует порт на хосте.

## Примечание

Вместо архивированного `containrrr/watchtower` используется форк `nickfedor/watchtower`. Скрипт `registry/create-user.sh` запрашивает пароль интерактивно.
