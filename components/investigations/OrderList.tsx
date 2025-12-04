import React from 'react';
import { InvestigationOrder } from '../../types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { ArrowUpTrayIcon, DocumentTextIcon, ClockIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface OrderListProps {
    orders: InvestigationOrder[];
    onUploadClick: (order: InvestigationOrder) => void;
    onViewReportClick: (order: InvestigationOrder) => void;
}

export const OrderList: React.FC<OrderListProps> = ({ orders, onUploadClick, onViewReportClick }) => {
    if (orders.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No investigations ordered yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {orders.map((order) => (
                <Card key={order.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${order.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                            {order.status === 'completed' ? <DocumentTextIcon className="w-6 h-6" /> : <ClockIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900">{order.testName}</h4>
                                {order.priority !== 'routine' && (
                                    <Badge variant={order.priority === 'stat' ? 'destructive' : 'secondary'} className="text-[10px] h-5">
                                        {order.priority.toUpperCase()}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                                Ordered on {new Date(order.orderedAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`
                            ${order.status === 'completed' ? 'border-green-500 text-green-600 bg-green-50' :
                                order.status === 'processing' ? 'border-blue-500 text-blue-600 bg-blue-50' :
                                    'border-gray-300 text-gray-500'}
                        `}>
                            {order.status}
                        </Badge>

                        {order.status === 'completed' ? (
                            <Button size="sm" variant="outline" onClick={() => onViewReportClick(order)}>
                                View Report
                            </Button>
                        ) : (
                            <Button size="sm" onClick={() => onUploadClick(order)}>
                                <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
                                Upload
                            </Button>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    );
};
