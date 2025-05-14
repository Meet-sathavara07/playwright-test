import { test, expect } from "@playwright/test";

test("user login and send and view a kudo", async ({ page }) => {
  await page.goto("https://www.cheerchampion.com");

  await page.getByRole("link", { name: "Login" }).click();

  await expect(page).toHaveURL("https://www.cheerchampion.com/login");
  await page.getByRole("button", { name: "Request OTP" }).isVisible();

  await page
    .getByRole("textbox", { name: "Email Id" })
    .fill("cp@cheerchampion.com");
  await page.getByRole("button", { name: "Request OTP" }).click();

  await page.getByText("cp@cheerchampion.com").isVisible();
  await page.getByRole("textbox", { name: "OTP" }).isVisible();
  await page.getByRole("button", { name: "Login/Signup" }).isVisible();

  await page.getByRole("textbox", { name: "OTP" }).click();
  await page.getByRole("textbox", { name: "OTP" }).fill("111111");
  await page.getByRole("button", { name: "Login/Signup" }).click();

  await expect(page).toHaveURL("https://www.cheerchampion.com");

  await page
    .getByRole("textbox", { name: "E.g. Hey Jen! You were" })
    .isVisible();
  await page.getByRole("textbox", { name: "E.g. Hey Jen! You were" }).click();
  await page
    .getByRole("textbox", { name: "E.g. Hey Jen! You were" })
    .fill("test");

  await page.getByRole("button", { name: "Next >>" }).click();
  await expect(page).toHaveURL("https://www.cheerchampion.com/kudo/library");

  await page.locator(".giphy-gif").first().click();

  await expect(page).toHaveURL("https://www.cheerchampion.com/kudo/recipients");

  await page.getByRole("heading", { name: "Preview" }).isVisible();
  await page.getByRole("img", { name: "Image" }).isVisible();

  await page.getByRole("textbox", { name: "Email Id" }).isVisible();
  await page.getByRole("button", { name: "Send" }).isVisible();

  await page.getByRole("textbox", { name: "Email Id" }).click();
  await page
    .getByRole("textbox", { name: "Email Id" })
    .fill("raj.mansuri@quantuminfoway.com");
  await page.getByRole("button", { name: "Send" }).click();

  await page.getByRole("link", { name: "Go To Feed" }).click();
  await expect(page).toHaveURL("https://www.cheerchampion.com/feeds");

});