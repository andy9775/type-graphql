import { GraphQLFieldResolver } from "graphql";

import { IOCContainer } from "../utils/container";
import {
  FieldResolverMetadata,
  FieldMetadata,
  BaseResolverMetadata,
} from "../metadata/definitions";
import { getParams, applyMiddlewares, applyAuthChecker } from "./helpers";
import { convertToType } from "../helpers/types";
import { BuildContext } from "../schema/build-context";
import { AuthChecker } from "../interfaces";
import { ActionData } from "../types";
import { Middleware } from "../interfaces/Middleware";

export function createHandlerResolver(
  resolverMetadata: BaseResolverMetadata,
): GraphQLFieldResolver<any, any, any> {
  const targetInstance = IOCContainer.getInstance(resolverMetadata.target);
  const {
    validate: globalValidate,
    authChecker,
    authMode,
    pubSub,
    globalMiddlewares,
  } = BuildContext;
  const middlewares = globalMiddlewares.concat(resolverMetadata.middlewares!);
  applyAuthChecker(middlewares, authMode, authChecker, resolverMetadata.roles);

  return async (root, args, context, info) => {
    const actionData: ActionData<any> = { root, args, context, info };
    return applyMiddlewares(actionData, middlewares, async () => {
      const params: any[] = await getParams(
        resolverMetadata.params!,
        actionData,
        globalValidate,
        pubSub,
      );
      return resolverMetadata.handler!.apply(targetInstance, params);
    });
  };
}

export function createAdvancedFieldResolver(
  fieldResolverMetadata: FieldResolverMetadata,
): GraphQLFieldResolver<any, any, any> {
  if (fieldResolverMetadata.kind === "external") {
    return createHandlerResolver(fieldResolverMetadata);
  }

  const targetType = fieldResolverMetadata.getObjectType!();
  const {
    validate: globalValidate,
    authChecker,
    authMode,
    pubSub,
    globalMiddlewares,
  } = BuildContext;
  const middlewares = globalMiddlewares.concat(fieldResolverMetadata.middlewares!);
  applyAuthChecker(middlewares, authMode, authChecker, fieldResolverMetadata.roles);

  return async (root, args, context, info) => {
    const actionData: ActionData<any> = { root, args, context, info };
    const targetInstance: any = convertToType(targetType, root);
    return applyMiddlewares(actionData, middlewares, async () => {
      // method
      if (fieldResolverMetadata.handler) {
        const params: any[] = await getParams(
          fieldResolverMetadata.params!,
          actionData,
          globalValidate,
          pubSub,
        );
        return fieldResolverMetadata.handler.apply(targetInstance, params);
      }
      // getter
      return targetInstance[fieldResolverMetadata.methodName];
    });
  };
}

export function createSimpleFieldResolver(
  fieldMetadata: FieldMetadata,
): GraphQLFieldResolver<any, any, any> {
  const { authChecker, authMode, globalMiddlewares } = BuildContext;
  const middlewares = globalMiddlewares.concat(fieldMetadata.middlewares!);
  applyAuthChecker(middlewares, authMode, authChecker, fieldMetadata.roles);

  return async (root, args, context, info) => {
    const actionData: ActionData<any> = { root, args, context, info };
    return await applyMiddlewares(actionData, middlewares, () => root[fieldMetadata.name]);
  };
}
