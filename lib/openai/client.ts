import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const OPENAI_MODELS = {
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
};

export const DEFAULT_MODEL = OPENAI_MODELS.GPT_4O;
