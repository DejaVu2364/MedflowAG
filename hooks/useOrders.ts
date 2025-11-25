import { useCallback } from 'react';
import { usePatientContext } from '../contexts/PatientContext';
import { useAuth } from '../contexts/AuthContext';
import { Order, OrderCategory } from '../types';

export const useOrders = () => {
    const { updateStateAndDb, logAuditEvent } = usePatientContext();
    const { currentUser } = useAuth();

    const addOrderToPatient = useCallback((patientId: string, orderData: Partial<Order>) => {
        if (!currentUser) return;
        const newOrder: Order = {
            orderId: `ORD-${Date.now()}`,
            patientId: patientId,
            createdBy: currentUser.id,
            createdAt: new Date().toISOString(),
            status: 'draft',
            priority: 'routine',
            category: 'investigation',
            subType: '',
            label: '',
            payload: {},
            ...orderData,
        };
        updateStateAndDb(patientId, p => ({ ...p, orders: [newOrder, ...p.orders] }));
        logAuditEvent({ userId: currentUser.id, patientId, action: 'create', entity: 'order', entityId: newOrder.orderId });
    }, [currentUser, logAuditEvent, updateStateAndDb]);

    const updateOrder = useCallback((patientId: string, orderId: string, updates: Partial<Order>) => {
        if (!currentUser) return;
        updateStateAndDb(patientId, p => {
            const newOrders = p.orders.map(o => o.orderId === orderId ? {
                ...o, ...updates, meta: { ...o.meta, lastModified: new Date().toISOString(), modifiedBy: currentUser.id }
            } : o);
            return { ...p, orders: newOrders };
        });
        logAuditEvent({ userId: currentUser.id, patientId, action: 'modify', entity: 'order', entityId: orderId, payload: { updates } });
    }, [currentUser, logAuditEvent, updateStateAndDb]);

    const acceptAIOrders = useCallback((patientId: string, orderIds: string[]) => {
        if (!currentUser) return;
        updateStateAndDb(patientId, p => {
            const newOrders = p.orders.map(o => orderIds.includes(o.orderId) && o.status === 'draft'
                ? { ...o, status: 'sent' as const, meta: { ...o.meta, lastModified: new Date().toISOString(), modifiedBy: currentUser.id } } : o
            );
            return { ...p, orders: newOrders };
        });
    }, [currentUser, updateStateAndDb]);

    const sendAllDrafts = useCallback((patientId: string, category: OrderCategory) => {
        if (!currentUser) return;
        updateStateAndDb(patientId, p => {
            const newOrders = p.orders.map(o => {
                if (o.category === category && o.status === 'draft') {
                    return { ...o, status: 'sent' as const, meta: { ...o.meta, lastModified: new Date().toISOString(), modifiedBy: currentUser.id } };
                }
                return o;
            });
            return { ...p, orders: newOrders };
        });
    }, [currentUser, updateStateAndDb]);

    return {
        addOrderToPatient,
        updateOrder,
        acceptAIOrders,
        sendAllDrafts
    };
};
