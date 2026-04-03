import { test, expect } from '@playwright/test'

const EMAIL = 'puczaras@metis.gg'
const PASSWORD = 'Artemis'

test.describe('Auth flow — PUC Zaras (premium)', () => {
  test('home pública carrega sem login', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Analise qualquer invocador')).toBeVisible()
    await expect(page.getByPlaceholder(/PUUID/i)).toBeVisible()
  })

  test('/chat sem login redireciona para /auth', async ({ page }) => {
    await page.goto('/chat')
    await expect(page).toHaveURL(/\/auth/)
  })

  test('login com credenciais PUC Zaras', async ({ page }) => {
    await page.goto('/auth')

    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    // Pós-login → home pública
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Chat Metis')).toBeVisible()
  })

  test('usuário premium acessa /chat e vê a interface de chat', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Navega para /chat
    await page.goto('/chat')

    // Aguarda hidratação (loading dots podem aparecer brevemente)
    await page.waitForTimeout(2000)

    // Não deve mostrar gate de premium
    await expect(page.getByText('Acesso Premium')).not.toBeVisible()

    // Deve mostrar a mensagem inicial da Metis
    await expect(page.getByText(/estrategista no Rift/i)).toBeVisible()

    // Input de chat disponível
    await expect(page.getByPlaceholder(/Pergunte para a Metis/i)).toBeVisible()
  })

  test('/auth com sessão ativa redireciona para /', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/')

    // Tenta acessar /auth novamente
    await page.goto('/auth')
    await expect(page).toHaveURL('/')
  })
})
