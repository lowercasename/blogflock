import Mailgun from "https://deno.land/x/mailgun@v1.3.0/index.ts";

const mailgun = new Mailgun({
  key: Deno.env.get("MAILGUN_API_KEY")!,
  region: "eu",
  domain: "mail.blogflock.com",
});

export const sendEmail = async (
  { to, text, subject }: { to: string; text: string; subject: string },
) =>
  await mailgun.send({
    to,
    from: "contact@blogflock.com",
    text,
    reply: "contact@blogflock.com",
    subject,
  });
