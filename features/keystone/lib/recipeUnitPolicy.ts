export function assertRecipeUnitContract(recipe: {
  yieldUnit: string;
  outputVariant: { unitOfMeasure: string } | null;
  ingredients: Array<{
    nameSnapshot: string;
    unit: string;
    inputVariant: { unitOfMeasure: string } | null;
  }>;
}): void {
  if (
    !recipe.outputVariant ||
    recipe.yieldUnit !== recipe.outputVariant.unitOfMeasure
  ) {
    throw new Error(
      "Recipe yield unit must match the output variant unit; unit conversion is not supported",
    );
  }
  for (const ingredient of recipe.ingredients) {
    if (
      ingredient.inputVariant &&
      ingredient.unit !== ingredient.inputVariant.unitOfMeasure
    ) {
      throw new Error(
        `Recipe ingredient ${ingredient.nameSnapshot} unit must match its inventory variant; unit conversion is not supported`,
      );
    }
  }
}
