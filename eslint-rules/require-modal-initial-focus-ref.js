module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require <Modal> elements to have an initialFocusRef prop",
      recommended: false,
    },
    schema: [],
    messages: {
      missingInitialFocusRef:
        "<Modal> is missing initialFocusRef. Pass a ref to the element that should receive focus on open.",
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        if (
          node.name.type === "JSXIdentifier" &&
          node.name.name === "Modal"
        ) {
          const hasInitialFocusRef = node.attributes.some(
            (attr) =>
              attr.type === "JSXAttribute" &&
              attr.name.name === "initialFocusRef"
          );

          if (!hasInitialFocusRef) {
            context.report({
              node,
              messageId: "missingInitialFocusRef",
            });
          }
        }
      },
    };
  },
};
